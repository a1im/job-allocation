export const toggleValue = <T>(
    arr: T[],
    value: T,
    select = !arr.includes(value),
): void => {
    const index = arr.indexOf(value);

    if (select && index === -1) {
        arr.push(value);
    } else if (!select && index !== -1) {
        arr.splice(index, 1);
    }
};
