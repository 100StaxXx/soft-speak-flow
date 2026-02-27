import { computeContentBoxAvailableSize, computeLargestAspectRect } from './useMaxAspectRect';

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

describe('computeContentBoxAvailableSize', () => {
  it('subtracts host paddings before aspect-fit sizing', () => {
    const contentBox = computeContentBoxAvailableSize(390, 260, {
      paddingLeft: '8px',
      paddingRight: '8px',
      paddingTop: '12px',
      paddingBottom: '10px',
    } as CSSStyleDeclaration);

    expect(contentBox).toEqual({ width: 374, height: 238 });

    const rect = computeLargestAspectRect(contentBox.width, contentBox.height, 6, 5);
    expect(rect.width).toBe(285.6);
    expect(rect.height).toBe(238);
  });

  it('clamps negative content-box dimensions to zero', () => {
    const contentBox = computeContentBoxAvailableSize(20, 10, {
      paddingLeft: '16px',
      paddingRight: '16px',
      paddingTop: '12px',
      paddingBottom: '12px',
    } as CSSStyleDeclaration);

    expect(contentBox).toEqual({ width: 0, height: 0 });
  });
});
