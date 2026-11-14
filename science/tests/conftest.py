# Lets pytest import sibling test modules the way `unittest discover -s tests` does
# (Shaimaa's Task 5 tests do `from test_reference import ...`).
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
