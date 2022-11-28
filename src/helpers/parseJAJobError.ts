import { JAJob, JAJobStatus } from '../worker/types';

export const parseJAJobError = ({
    job,
    errorMessage,
}: {
    job: JAJob<any>
    errorMessage: string
}): JAJob<undefined> => ({
    ...job,
    onFinished: Date.now(),
    status: JAJobStatus.ERROR,
    errorMessage,
});
