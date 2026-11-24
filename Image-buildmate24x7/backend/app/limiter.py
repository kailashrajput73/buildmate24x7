from slowapi import Limiter
from slowapi.util import get_remote_address

# Per-process rate limit; a production reverse proxy must also limit login attempts.
limiter = Limiter(key_func=get_remote_address, default_limits=[])
