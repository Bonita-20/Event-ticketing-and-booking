class Node {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

export class Queue {
  #head = null;
  #tail = null;
  #size = 0;

  /**
   * Adds an item to the back of the queue in O(1) time.
   * @param {*} value
   */
  enqueue(value) {
    const node = new Node(value);
    if (this.#size === 0) {
      this.#head = node;
      this.#tail = node;
    } else {
      this.#tail.next = node;
      this.#tail = node;
    }
    this.#size += 1;
  }

  /**
   * Removes and returns the item at the front of the queue in O(1) time.
   * Returns undefined if the queue is empty.
   * @returns {*}
   */
  dequeue() {
    if (this.#size === 0) {
      return undefined;
    }

    const removed = this.#head;
    this.#head = removed.next;
    removed.next = null; // Help garbage collection
    this.#size -= 1;

    if (this.#size === 0) {
      this.#tail = null;
    }

    return removed.value;
  }

  /**
   * Returns the front item without removing it in O(1) time.
   * @returns {*}
   */
  peek() {
    return this.#head ? this.#head.value : undefined;
  }

  /**
   * Returns the current number of items in the queue in O(1) time.
   * @returns {number}
   */
  get size() {
    return this.#size;
  }
}