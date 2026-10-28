import { useEffect, useState } from 'react';

export interface Question {
  q: string;
  options: string[];
  answer: number;
  why: string;
}

/** Self-check at the end of a lesson. Progress is kept in this browser only. */
export default function Quiz({ id, questions }: { id: string; questions: Question[] }) {
  const key = `mv-quiz-${id}`;
  const [picks, setPicks] = useState<(number | null)[]>(() => questions.map(() => null));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (Array.isArray(saved) && saved.length === questions.length) setPicks(saved);
    } catch {}
  }, []);

  function pick(qi: number, oi: number) {
    setPicks((p) => {
      const next = p.map((v, i) => (i === qi ? oi : v));
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const score = picks.filter((p, i) => p === questions[i].answer).length;
  const done = picks.every((p) => p !== null);

  return (
    <div className="not-content space-y-4">
      {questions.map((qq, qi) => {
        const chosen = picks[qi];
        return (
          <fieldset key={qi} className="rounded-xl border border-(--sl-color-hairline-shade) p-4">
            <legend className="px-1 text-[0.72rem] font-bold uppercase tracking-wider text-(--sl-color-gray-3)">
              Question {qi + 1} of {questions.length}
            </legend>
            <p className="mb-3 font-medium text-(--sl-color-white)">{qq.q}</p>
            <div className="grid gap-2">
              {qq.options.map((o, oi) => {
                const isPicked = chosen === oi;
                const isRight = oi === qq.answer;
                const state = chosen === null ? 'idle' : isRight ? 'right' : isPicked ? 'wrong' : 'idle';
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => pick(qi, oi)}
                    aria-pressed={isPicked}
                    className="cursor-pointer rounded-lg border bg-transparent px-3 py-2 text-left text-(--sl-color-white) text-[0.9rem] transition-colors hover:bg-(--sl-color-gray-6)"
                    style={{
                      borderColor:
                        state === 'right' ? 'var(--viz-profit)' : state === 'wrong' ? 'var(--viz-loss)' : 'var(--sl-color-hairline-shade)',
                      background: state === 'right' ? 'var(--viz-profit-wash)' : state === 'wrong' ? 'var(--viz-loss-wash)' : undefined,
                    }}
                  >
                    {state === 'right' ? '✓ ' : state === 'wrong' ? '✗ ' : ''}
                    {o}
                  </button>
                );
              })}
            </div>
            {chosen !== null && (
              <p className="mt-3 text-[0.85rem] text-(--sl-color-gray-2)">
                <b>{chosen === qq.answer ? 'Correct.' : 'Not quite.'}</b> {qq.why}
              </p>
            )}
          </fieldset>
        );
      })}
      {done && (
        <p className="text-[0.9rem] font-semibold">
          Score: {score} / {questions.length}
          {score === questions.length ? ' · Lesson mastered.' : ' · Review the sections above and try again.'}
        </p>
      )}
    </div>
  );
}
