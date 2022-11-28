import { delay } from './delay';

export const createRequestLimiter = ({
    max,
    duration,
}: {
    max: number // кол-во
    duration: number // за какое время
}) => {
    if (max <= 0 || duration <= 0) {
        throw new Error('createRequestLimiter: error max > 0 and duration > 0');
    }
    const timeList: number[] = [];
    const checkWait = async () => {
        let delayTime = 0;
        const isReady = max > timeList.length;

        if (isReady) {
            timeList.push(Date.now());
            setTimeout(() => timeList.shift(), duration);
        } else {
            const dateNow = Date.now();
            const [firstTime = 0] = timeList;

            delayTime = duration - (dateNow - firstTime) + 5;
        }

        return {
            isReady,
            delayTime: Math.max(delayTime, 10),
        };
    };
    const wait = async () => {
        const {
            isReady,
            delayTime,
        } = await checkWait();

        if (!isReady) {
            await delay(delayTime);
            await wait();
        }
    };

    return {
        checkWait,
        wait,
    };
};
