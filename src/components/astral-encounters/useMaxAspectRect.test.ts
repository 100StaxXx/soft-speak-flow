import { computeLargestAspectRect } from './useMaxAspectRect';

describe('computeLargestAspectRect', () => {
  it('fits by width when width is the limiting dimension', () => {
    const rect = computeLargestAspectRect(300, 400, 6, 5);

    expect(rect.width).toBe(300);
    expect(rect.height).toBe(250);
  });

  it('fits by height when height is the limiting dimension', () => {
    const rect = computeLargestAspectRect(400, 200, 6, 5);

    expect(rect.width).toBe(240);
    expect(rect.height).toBe(200);
  });

  it('returns a stable non-zero fallback for invalid available dimensions', () => {
    const rect = computeLargestAspectRect(0, Number.NaN, 6, 5);

    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
    expect(rect.width / rect.height).toBeCloseTo(6 / 5, 4);
  });
});
