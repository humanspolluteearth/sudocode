#!/bin/sh
# `pnpm py:expect [files...]`: fills in `expect.stdout`/`errors` of Python golden programs by running CPython 3.12.
# With no files, every Python program under packages/core/tests/ (golden, harvested, ...). Never hand-write these.
set -e
cd "$(dirname "$0")/.."
PY=${PYTHON312:-python3.12}
if [ "$#" -eq 0 ]; then set -- $(find packages/core/tests -name '*.py' -not -path '*/errors/*' | sort); fi
exec "$PY" scripts/python-oracle.py --write "$@"
