extern fn printNumber(num: usize) void;

extern fn top() usize;

// These push a new value on the stack
extern fn getGlobal(name: [*:0]const u8) usize;
extern fn getProp(obj: usize, name: [*:0]const u8) usize;
extern fn getIndex(arr: usize, idx: i32) usize;

extern fn pushInt(num: i32) void;
extern fn pushFloat(num: f64) void;
extern fn pushBoolean(val: bool) void;
extern fn pushNull() void;
extern fn pushObject() void;
extern fn toArray(nargs: usize) void;
extern fn pushString(str: [*:0]const u8) void;
extern fn pushBuffer(ptr: []u8, len: usize) void;
extern fn pushReference(ref: usize) void;

// These pop a value from the stack
extern fn setGlobal(name: [*:0]const u8) void;
extern fn setProp(obj: usize, name: [*:0]const u8) void;
extern fn setIndex(arr: usize, idx: i32) void;

extern fn popInt() i32;
extern fn popFloat() f64;
extern fn popBoolean() bool;
extern fn popNull() null;
extern fn peekString() usize; // Read the length of the string at top
extern fn popString(ptr: [*]u8) void;
extern fn peekBuffer() usize; // Read the length of the buffer at top
extern fn popBuffer(ptr: [*]u8) void;
extern fn popReference() usize;

// These pop 0 or more values and push one value
extern fn apply(idx: usize, nargs: usize) usize;
extern fn applyMethod(idx: usize, name: [*:0]const u8, nargs: usize) usize;
extern fn send(idx: usize, nargs: usize) void;
extern fn sendMethod(idx: usize, name: [*:0]const u8, nargs: usize) void;

///////////////////////////////////////////////////////////////////////////////

fn setProperty(obj: usize, name: [*:0]const u8, arg: var) void {
    pushArg(arg);
    return setProp(obj, name);
}

fn setSlot(obj: usize, idx: i32, arg: var) void {
    pushArg(arg);
    return setIndex(obj, idx);
}

fn callMethod(idx: usize, name: [*:0]const u8, args: var) usize {
    pushArgs(args);
    return applyMethod(idx, name, args.len);
}

fn callMethodNoRet(idx: usize, name: [*:0]const u8, args: var) void {
    pushArgs(args);
    return sendMethod(idx, name, args.len);
}

fn pushArray(args: var) void {
    pushArgs(args);
    return toArray(args.len);
}

fn pushArgs(args: var) void {
    comptime var i = 0;
    inline while (i != args.len) : (i += 1) {
        pushArg(args[i]);
    }
}

fn pushArg(arg: var) void {
    comptime const T = @TypeOf(arg);
    const I = @typeInfo(T);
    switch (I) {
        .Int, .ComptimeInt => return pushInt(arg),
        .Float, .ComptimeFloat => return pushFloat(arg),
        .Bool => return pushBoolean(arg),
        .Null => return pushNull(),
        .Struct => {
            if (@hasDecl(T, "addArgument")) return arg.addArgument();

            const obj = pushObject();
            inline for (I.Struct.fields) |field| {
                pushArg(@field(arg, field.name));
                setProp(obj, field.name);
            }
            return obj;
        },
        .Pointer => {
            const II = @typeInfo(I.Pointer.child);
            switch (II) {
                .Array => {
                    if (II.Array.child == u8) {
                        return pushString(arg);
                    }
                },
                else => {},
            }
            @compileLog("Unsupported pointer used in call", T);
        },
        else => {
            @compileLog("Unsupported type used in call", T);
        },
    }
}

export fn main() void {
    // const console = getGlobal("console");
    const document = getGlobal("document");
    const body = getProp(document, "body");
    const head = getProp(document, "head");

    const style = callMethod(document, "createElement", .{"style"});
    setProperty(style, "textContent", "body { background:#000; color:#fff; }");
    sendMethod(head, "appendChild", 1);

    setProperty(body, "innerHTML", "<h1>Hello from zig</h1>");

    // callMethodNoRet(console, "log", .{ 10, 3.141592653589793, true, false });
    // pushArray(.{ 1, 2, 3, 4 });
    // setSlot(top(), 100, "Find me!");
    // setGlobal("list");

    // const document = getGlobal(intern("document"));
    // const h1 = document.callMethod("createElement", .{"h1"});
    // h1.callMethod("setAttribute", "id", "custom-id");

    // console.callMethod("log", .{.{ .h1 = h1 }});
}
