export const delay = (v: number) => new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, v));
});
