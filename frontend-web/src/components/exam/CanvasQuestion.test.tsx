import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CanvasQuestion } from './CanvasQuestion';

describe('CanvasQuestion Component', () => {
  it('renders a canvas element without leaking question text into attributes', () => {
    const questionText = 'What is the time complexity of QuickSort in the average case?';
    const { container } = render(
      <CanvasQuestion
        text={questionText}
        studentId="std-101"
        studentEmail="student@cira.edu"
      />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    // Verify question string is NOT exposed in attributes
    expect(canvas?.getAttribute('aria-label')).toBeNull();
    expect(canvas?.getAttribute('alt')).toBeNull();
    expect(canvas?.getAttribute('title')).toBeNull();
    expect(canvas?.getAttribute('data-question')).toBeNull();
  });

  it('renders with custom font size and styling cleanly', () => {
    const { container } = render(
      <CanvasQuestion
        text="Sample multi-line question text here."
        fontSize={20}
        lineHeight={30}
        color="#8B0000"
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('select-none');
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });
});
