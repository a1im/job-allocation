import { v4 as uuidv4 } from 'uuid';
import { JAJob, JAJobStatus } from '../worker/types';

export const createJAJob = <T>(data: T): JAJob<T> => {
    const id = uuidv4();

    return {
        id,
        data,
        onCreated: Date.now(),
        status: JAJobStatus.WAIT,
    };
};
