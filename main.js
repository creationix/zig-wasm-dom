
async function main() {

  const stringCache = {};
  /**
   * @param {number} ptr
   * @param {number} len
   */
  function readString(ptr) {
    const cached = stringCache[ptr];
    if (cached !== undefined) return cached;
    const mem = new Uint8Array(exports.memory.buffer, ptr);
    let length = 0;
    while (mem[length]) length++;
    const slice = mem.subarray(0, length);
    return stringCache[ptr] = new TextDecoder().decode(slice)
  }

  /** @type {Object[]} */
  const indexToOpaque = []
  /** @type {WeakMap<Object,number>} */
  const opaqueToIndex = new WeakMap()
  function storeOpaque(obj) {
    if (opaqueToIndex.has(obj)) {
      return opaqueToIndex.get(obj)
    }
    const idx = indexToOpaque.push(obj) - 1
    opaqueToIndex.set(obj, idx)
    return idx
  }
  function getOpaque(idx) {
    return indexToOpaque[idx]
  }

  const args = [];

  /** @type {{ instance:{exports: {
    memory: WebAssembly.Memory,
    main(): void,
  }}}} */
  const { instance: { exports } } = await WebAssembly.instantiateStreaming(fetch("main.wasm"), {
    env: wrap({
      printNumber: num => console.log(num),
      top: () => args.length - 1,

      // These push a new value on the stack
      getGlobal: name => args.push(globalThis[readString(name)]) - 1,
      getProp: (obj, name) => args.push(args[obj][readString(name)]) - 1,
      getIndex() { },//(arr: usize, idx: i32) usize;

      pushInt: num => { args.push(num) },
      pushFloat: num => { args.push(num) },
      pushBoolean: val => { args.push(!!val) },
      pushNull() { },//() usize;
      pushObject() { },//() usize;
      toArray: nargs => {
        args.push(args.splice(args.length - nargs, nargs))
      },
      pushString: (ptr, len) => { args.push(readString(ptr, len)) },
      pushBuffer() { },//(ptr: [*]const u8, len: usize) usize;
      pushReference() { },//(ref: usize) usize;

      // These pop a value from the stack
      setGlobal: name => { globalThis[readString(name)] = args.pop() },
      setProp: (obj, name) => { args[obj][readString(name)] = args.pop() },
      setIndex: (arr, idx) => { args[arr][idx] = args.pop() },

      popInt() { },//() i32;
      popFloat() { },//() f64;
      popBoolean() { },//() bool;
      popNull() { },//() null;
      peekString() { },//() usize; // Read the length of the string at top
      popString() { },//(ptr: [*]u8) void;
      peekBuffer() { },//() usize; // Read the length of the buffer at top
      popBuffer() { },//(ptr: [*]u8) void;
      popReference() { },//() usize;

      // These pop 0 or more values and push one value
      apply: (idx, nargs) => args.push(args[idx](...args.splice(args.length - nargs, nargs))) - 1,
      applyMethod: (idx, name, nargs) => args.push(args[idx][readString(name)](...args.splice(args.length - nargs, nargs))) - 1,
      send: (idx, nargs) => { args[idx](...args.splice(args.length - nargs, nargs)) },
      sendMethod: (idx, name, nargs) => { args[idx][readString(name)](...args.splice(args.length - nargs, nargs)) },


      // globalGetOpaque: (ptr, len) => storeOpaque(globalThis[readString(ptr, len)]),
      // propertyGetOpaque: (obj, ptr, len) => storeOpaque(getOpaque(obj)[readString(ptr, len)]),
      // pushInt: num => args.push(num),
      // pushFloat: num => args.push(num),
      // pushBoolean: val => args.push(Boolean(val)),
      // pushUndefined: () => args.push(undefined),
      // pushNull: () => args.push(null),
      // pushString: (ptr, len) => args.push(readString(ptr, len)),
      // pushOpaque: (idx) => args.push(getOpaque(idx)),
      // pushObject: () => args.push({}),
      // setField: (ptr, len) => {
      //   const val = args.pop();
      //   args[args.length - 1][readString(ptr, len)] = val;
      // },
      // apply(idx) {
      //   const fn = getOpaque(idx);
      //   const list = args.slice(0);
      //   args.length = 0;
      //   fn.apply(null, list);
      // },
      // applyMethod(idx, ptr, len) {
      //   const obj = getOpaque(idx)
      //   const fn = obj[readString(ptr, len)]
      //   const list = args.slice(0)
      //   args.length = 0
      //   fn.apply(obj, list);
      // },
      // document: {
      //   createDocumentFragment: () => storeOpaque(document.createDocumentFragment()),
      //   createElement: (ptr, len) => storeOpaque(document.createElement(readString(ptr, len))),
      // },
      // element: {
      //   setAttribute: (node, ptr, len) => getOpaque(node).setAttribute(readString(ptr, len), args.pop()),
      //   appendChild: (parent, child) => getOpaque(parent).appendChild(getOpaque(child)),
      // }
    })
  })

  exports.main();

  console.log({ stringCache })

  function wrap(obj) {
    const wrapped = {};
    for (const key in obj) {
      const fn = obj[key];
      wrapped[key] = (...a) => {
        console.group(fn.name, a);
        console.log(args);
        const res = fn(...a)
        console.log(args);
        console.log(res);
        console.groupEnd();
        return res;
      }
    }
    return wrapped;
  }
}


main()
