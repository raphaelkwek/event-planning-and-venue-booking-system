/**
 * ADR-0004's first boundary check: a module imports another module only
 * through that module's index.ts, and shared code imports no module at all.
 * Run with `npm run lint:boundaries`, which also runs the SQL schema check.
 */
export default {
  forbidden: [
    {
      name: "no-reaching-into-another-module",
      comment:
        "Import another module only through its index.ts (ADR-0004). Its other files are internal and may change without warning.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/" },
      to: {
        path: "^src/modules/([^/]+)/",
        pathNot: ["^src/modules/$1/", "^src/modules/[^/]+/index\\.ts$"],
      },
    },
    {
      name: "shared-imports-no-module",
      comment: "src/shared is infrastructure every module uses, so it must not depend on any of them.",
      severity: "error",
      from: { path: "^src/shared/" },
      to: { path: "^src/modules/" },
    },
    {
      name: "no-circular",
      comment: "A cycle between files makes the module boundaries meaningless.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
