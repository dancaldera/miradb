/**
 * Debounced writer for batching file write operations
 * Prevents blocking I/O by deferring writes and batching multiple updates
 */

type WriteFn<T> = (data: T) => Promise<void>;

export class DebouncedWriter<T> {
	private timer: NodeJS.Timeout | null = null;
	private pendingData: T | null = null;
	private readonly writeFn: WriteFn<T>;
	private readonly delay: number;
	private isWriting = false;
	private isDirty = false;

	constructor(writeFn: WriteFn<T>, delay = 500) {
		this.writeFn = writeFn;
		this.delay = delay;
	}

	/**
	 * Schedule a write operation (debounced)
	 */
	write(data: T): void {
		this.pendingData = data;
		this.isDirty = true;

		// Clear existing timer
		if (this.timer) {
			clearTimeout(this.timer);
		}

		// Schedule new write
		this.timer = setTimeout(() => {
			void this.flush();
		}, this.delay);
	}

	/**
	 * Immediately flush pending writes
	 */
	async flush(): Promise<void> {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		if (!this.isDirty || !this.pendingData || this.isWriting) {
			return;
		}

		this.isWriting = true;
		const dataToWrite = this.pendingData;
		this.isDirty = false;

		try {
			await this.writeFn(dataToWrite);
		} catch (error) {
			// Silent fail - we don't want cache errors to crash the app
			console.error("Debounced write failed:", error);
		} finally {
			this.isWriting = false;

			// If more writes came in while we were writing, schedule another flush
			if (this.isDirty) {
				this.timer = setTimeout(() => {
					void this.flush();
				}, this.delay);
			}
		}
	}

	/**
	 * Cancel pending writes
	 */
	cancel(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.pendingData = null;
		this.isDirty = false;
	}
}
