# Local deepmerge security fix

Expo config and Jest configuration still require the deepmerge 4.x merge API. Expo merges app configuration and existing plugin options; Jest merges preset globals. Upstream 4.3.1 can copy an own `__proto__` key into a fresh target through the inherited prototype setter, changing the returned object's prototype (GHSA-gcqx-w48m-w2h4).

The pnpm patch excludes `__proto__` from enumerable keys before reading source or target properties in all three published entrypoints. Other keys, symbols, arrays, custom merges and clone behavior retain upstream semantics. No package identity or version is disguised.

OSV cannot identify patched package bytes from the upstream version alone. The gate accepts only this advisory for deepmerge 4.3.1 in the root lockfile, after verifying the exact patch digest, every resolved dependency pin, and all installed entrypoint digests and behavior. Any missing/tampered patch, unpatched reference, different advisory/version or unresolved finding fails. This is a verified local fix, not a baseline expansion or blanket ignore.

The regression recreates pristine upstream code and proves inherited attacker state, then exercises the patched package, real Expo configuration/plugin merging and compatibility behavior. Keep the patch and verifier together. Replace them with an upstream fixed release or compatible maintained replacement when available; do not extend this exception to another advisory.

Advisory: https://github.com/advisories/GHSA-gcqx-w48m-w2h4
