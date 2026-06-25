from pydantic import BaseModel, Field
from typing import List, Optional

class AssignmentRequest(BaseModel):
    student_id: str = Field(..., description="Unique identifier for the student")
    tier: str = Field(..., description="Current performance tier (Poor, Average, Excellent)")
    failed_topics: List[str] = Field(..., description="Array of specific sub-divisions or topics where the student failed")
    faculty_override_tier: Optional[str] = Field(None, description="Faculty recommendation override for difficulty (Easy, Medium, Hard)")
