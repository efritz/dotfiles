import { Stream } from '../providers/util/provider'
import { CancelError } from './interrupts'
import { invertPromise } from './promise'

export function abortableIterator<T>(iterable: AsyncIterable<T>, abortIterable: () => void): Stream<T> {
    const { promise: aborted, reject: abort } = invertPromise()
    const innerIterator = iterable[Symbol.asyncIterator]()
    const iterator: AsyncIterableIterator<T> = {
        [Symbol.asyncIterator]: () => iterator, // return self
        next: () => Promise.race([innerIterator.next(), aborted]), // AsyncIterator
    }

    return {
        iterator,
        abort: () => {
            abortIterable()
            abort(new CancelError('Provider stream canceled'))
        },
    }
}
