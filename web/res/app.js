// ../core/util/AppUtil.ts
var formatUptime = (seconds) => {
  const rounded = Math.floor(seconds);
  return `${rounded}s`;
};
// app.ts
console.log("hello world", formatUptime(10));
