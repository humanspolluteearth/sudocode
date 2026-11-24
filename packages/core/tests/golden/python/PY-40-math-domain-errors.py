import math
for f, arg in [(math.sqrt, -1), (math.log, 0), (math.log, -5)]:
    try:
        f(arg)
    except ValueError as e:
        print("ValueError:", e)
try:
    math.pow(0, -1)
except ValueError as e:
    print("ValueError:", e)
try:
    math.floor("a")
except TypeError as e:
    print("TypeError:", e)
try:
    math.sqrt(10 ** 400)
except OverflowError as e:
    print("OverflowError:", e)
print(math.sqrt(-4))
