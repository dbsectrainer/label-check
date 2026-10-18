// Run with: node ratelimit.test.js
const assert = require("node:assert/strict");
const { createLimiter } = require("./ratelimit.js");

let clock = 0;
const allow = createLimiter(3, 1000, () => clock);

assert.equal(allow("a"), true);
assert.equal(allow("a"), true);
assert.equal(allow("a"), true);
assert.equal(allow("a"), false, "fourth call in the window is refused");
assert.equal(allow("b"), true, "other clients are unaffected");
clock = 1000;
assert.equal(allow("a"), true, "window resets");
console.log("ok  rate limiter (3 tests)");
