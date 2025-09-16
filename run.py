#!/usr/bin/env python3
from __future__ import annotations

import os
import uvicorn


def main() -> None:
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8003"))
    reload = os.getenv("RELOAD", "1") not in ("0", "false", "False")
    uvicorn.run("app.main:app", host=host, port=port, reload=reload)


if __name__ == "__main__":
    main()

