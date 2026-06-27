"""
services/topic_matcher_service.py
──────────────────────────────────
Matches a student's weak topic strings to question bank topics using
sentence-transformers semantic similarity.

Why semantic similarity instead of string matching?
───────────────────────────────────────────────────
A student's weak topic might be stored as "recursion" in exam results
but the question bank might tag equivalent questions as:
  • "recursive algorithms"
  • "recursive functions and calls"
  • "recursion and backtracking"

Exact string matching misses all three.
Cosine similarity on sentence embeddings catches them because the model
understands that these phrases mean the same thing.

Pipeline (per request)
──────────────────────
1. Fetch all distinct topic strings from the questions collection  (Motor)
2. Encode weak topics + bank topics into embedding vectors          (sentence-transformers)
3. Compute cosine similarity matrix                                 (sklearn)
4. For each weak topic: find bank topics above the threshold        (numpy)
5. Fetch questions for the matched bank topics, filtered by difficulty (Motor)
6. Attach traceability (which weak topic → which bank topic → which question)
7. Return structured response

Model choice: all-MiniLM-L6-v2
───────────────────────────────
• 80 MB, fast (CPU-friendly), strong performance on short-phrase similarity.
• Ideal for topic strings which are typically 1–5 words.
• Loaded lazily and cached on the service instance so it is initialised
  once per FastAPI worker, not once per request.
"""

from __future__ import annotations

from typing import List, Dict, Tuple

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..schemas.topic_matcher import (
    MatchedQuestion,
    TopicMatch,
    TopicMatchRequest,
    TopicMatchResponse,
)

MODEL_NAME = "all-MiniLM-L6-v2"


class TopicMatcherService:

    def __init__(self, db: AsyncIOMotorDatabase, model_name: str = MODEL_NAME) -> None:
        self.db = db
        self._model_name = model_name
        self._model = None          # lazy — loaded on first request

    # ── Public ────────────────────────────────────────────────────────────────

    async def match(self, request: TopicMatchRequest) -> TopicMatchResponse:
        """
        Full pipeline: weak topic strings → matched questions from the bank.

        Steps
        ─────
        1  Fetch distinct bank topics from MongoDB.
        2  Embed both lists with sentence-transformers.
        3  Compute cosine similarity matrix (n_weak × n_bank).
        4  For each weak topic pick all bank topics above the threshold.
        5  Fetch questions for those bank topics, filtered by difficulty.
        6  Build and return the response.
        """
        weak_topics = [t.lower().strip() for t in request.weak_topics]

        if not weak_topics:
            return self._empty_response(request)

        # ── Step 1 ────────────────────────────────────────────────────────────
        bank_topics = await self._fetch_distinct_topics()

        if not bank_topics:
            return self._empty_response(request)

        # ── Step 2 ────────────────────────────────────────────────────────────
        weak_embeddings = self._encode(weak_topics)
        bank_embeddings = self._encode(bank_topics)

        # ── Step 3 ────────────────────────────────────────────────────────────
        # shape: (n_weak_topics, n_bank_topics)
        sim_matrix = cosine_similarity(weak_embeddings, bank_embeddings)

        # ── Step 4 ────────────────────────────────────────────────────────────
        topic_matches, bank_topic_map = self._build_topic_matches(
            weak_topics=weak_topics,
            bank_topics=bank_topics,
            sim_matrix=sim_matrix,
            threshold=request.similarity_threshold,
        )

        # ── Step 5 ────────────────────────────────────────────────────────────
        matched_questions: List[MatchedQuestion] = []
        if bank_topic_map:
            matched_questions = await self._fetch_questions(
                bank_topic_map=bank_topic_map,
                difficulty=request.difficulty,
                questions_per_topic=request.questions_per_topic,
            )

        unmatched = [
            tm.weak_topic for tm in topic_matches if not tm.has_match
        ]

        return TopicMatchResponse(
            weak_topics_received=request.weak_topics,
            topic_matches=topic_matches,
            matched_questions=matched_questions,
            total_questions=len(matched_questions),
            unmatched_weak_topics=unmatched,
            similarity_threshold_used=request.similarity_threshold,
        )

    # ── Step 2: encode ────────────────────────────────────────────────────────

    def _encode(self, texts: List[str]) -> np.ndarray:
        """
        Encode a list of strings into sentence embeddings.

        The model is loaded lazily on the first call and cached on self._model.
        Subsequent calls within the same FastAPI worker reuse the loaded model —
        no re-initialisation overhead per request.
        """
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name)
        return self._model.encode(texts, convert_to_numpy=True)

    # ── Step 4: match ─────────────────────────────────────────────────────────

    @staticmethod
    def _build_topic_matches(
        weak_topics: List[str],
        bank_topics: List[str],
        sim_matrix: np.ndarray,
        threshold: float,
    ) -> Tuple[List[TopicMatch], Dict[str, Tuple[str, float]]]:
        """
        For each weak topic, find all bank topics whose cosine similarity
        exceeds the threshold.

        Returns
        ───────
        topic_matches   : List[TopicMatch] — one per weak topic
        bank_topic_map  : Dict[bank_topic → (weak_topic, similarity_score)]
                          Used by _fetch_questions to attach traceability.

        When multiple weak topics match the same bank topic, the one
        with the higher similarity score wins (the map value is replaced
        only if the new score is higher).
        """
        topic_matches: List[TopicMatch] = []
        # bank_topic → (weak_topic, similarity_score)
        bank_topic_map: Dict[str, Tuple[str, float]] = {}

        for i, weak_topic in enumerate(weak_topics):
            row = sim_matrix[i]                          # similarities to all bank topics

            # Pairs above threshold, sorted best-first
            above = sorted(
                [
                    (bank_topics[j], float(row[j]))
                    for j in range(len(bank_topics))
                    if row[j] >= threshold
                ],
                key=lambda x: x[1],
                reverse=True,
            )

            for bank_topic, score in above:
                # Keep the highest-scoring weak topic for each bank topic
                if bank_topic not in bank_topic_map or score > bank_topic_map[bank_topic][1]:
                    bank_topic_map[bank_topic] = (weak_topic, score)

            top_score = above[0][1] if above else 0.0
            topic_matches.append(
                TopicMatch(
                    weak_topic=weak_topic,
                    matched_bank_topics=[bt for bt, _ in above],
                    top_similarity_score=round(top_score, 4),
                    has_match=len(above) > 0,
                )
            )

        return topic_matches, bank_topic_map

    # ── Step 5: fetch questions ───────────────────────────────────────────────

    async def _fetch_questions(
        self,
        bank_topic_map: Dict[str, Tuple[str, float]],
        difficulty: str,
        questions_per_topic: int,
    ) -> List[MatchedQuestion]:
        """
        Motor aggregation pipeline — fetch questions for matched topics.

        Stage 1 — $match
          Filter by topic (in the matched bank topics) AND difficulty.

        Stage 2 — $group by topic
          Collect all matching questions into an array per topic.

        Stage 3 — $project with $slice
          Limit to `questions_per_topic` questions per topic so we don't
          return the entire bank for a popular topic.

        Stage 4 — $unwind + $replaceRoot
          Flatten back to one document per question.

        After fetching, we attach the matched_from_weak_topic and
        similarity_score from bank_topic_map.
        """
        matched_bank_topics = list(bank_topic_map.keys())

        pipeline = [
            # ── Stage 1 ──────────────────────────────────────────────────────
            {
                "$match": {
                    "topic":      {"$in": matched_bank_topics},
                    "difficulty": difficulty,
                }
            },
            # ── Stage 2 ──────────────────────────────────────────────────────
            {
                "$group": {
                    "_id":       "$topic",
                    "questions": {"$push": "$$ROOT"},
                }
            },
            # ── Stage 3 ──────────────────────────────────────────────────────
            {
                "$project": {
                    "questions": {"$slice": ["$questions", questions_per_topic]}
                }
            },
            # ── Stage 4 ──────────────────────────────────────────────────────
            {"$unwind":     "$questions"},
            {"$replaceRoot": {"newRoot": "$questions"}},
        ]

        docs = await self.db["questions"].aggregate(pipeline).to_list(length=None)

        questions: List[MatchedQuestion] = []
        for doc in docs:
            bank_topic = doc.get("topic", "")
            weak_topic, sim_score = bank_topic_map.get(bank_topic, ("unknown", 0.0))
            questions.append(
                MatchedQuestion(
                    question_id=str(doc.get("_id", "")),
                    topic=bank_topic,
                    sub_topic=doc.get("sub_topic"),
                    difficulty=doc.get("difficulty", difficulty),
                    question_text=doc.get("question_text", ""),
                    options=doc.get("options", []),
                    correct_answer=doc.get("correct_answer"),
                    marks=doc.get("marks", 1),
                    matched_from_weak_topic=weak_topic,
                    similarity_score=round(sim_score, 4),
                )
            )

        return questions

    # ── Step 1: fetch bank topics ─────────────────────────────────────────────

    async def _fetch_distinct_topics(self) -> List[str]:
        """
        Get all unique topic strings from the question bank.
        Uses a simple $group aggregation — fast even on large collections
        because topic is a low-cardinality field.
        """
        pipeline = [
            {"$group": {"_id": "$topic"}},
            {"$match": {"_id": {"$ne": None}}},
            {"$sort":  {"_id": 1}},
        ]
        docs = await self.db["questions"].aggregate(pipeline).to_list(length=None)
        return [str(doc["_id"]).lower().strip() for doc in docs if doc["_id"]]

    # ── Empty response guard ──────────────────────────────────────────────────

    @staticmethod
    def _empty_response(request: TopicMatchRequest) -> TopicMatchResponse:
        return TopicMatchResponse(
            weak_topics_received=request.weak_topics,
            topic_matches=[],
            matched_questions=[],
            total_questions=0,
            unmatched_weak_topics=list(request.weak_topics),
            similarity_threshold_used=request.similarity_threshold,
        )