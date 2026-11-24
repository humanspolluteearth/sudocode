import math
from math import sqrt, pi as PI
import math as m

print(math.sqrt(16), sqrt(2), math.sqrt(0))
print(math.floor(2.7), math.floor(-2.1), math.ceil(2.1), math.ceil(-2.7), math.floor(5), type(math.floor(2.5)).__name__)
print(math.pi, math.e, PI, m.pi)
print(math.pow(2, 10), math.pow(2, 0.5), math.pow(-8, 3), math.pow(0, 0))
print(math.fabs(-3), math.fabs(2.5), math.trunc(2.9), math.trunc(-2.9), type(math.trunc(2.9)).__name__)
print(math.log(1), math.log(math.e), math.log(8, 2), math.log(100, 10), math.log(1000, 10))
print(math.sin(0), math.cos(0), math.tan(0))
print(math.sin(math.pi / 2), math.cos(math.pi), round(math.sin(math.pi), 10))
print(round(math.tan(math.pi / 4), 10))
print(math.sqrt(10 ** 20), math.sqrt(2 ** 60))
print(math.floor(10 ** 20 + 0.0), math.ceil(1e15 + 0.5))
radius = 2.5
print(f"Area: {math.pi * radius ** 2:.2f}")
print(math.floor(7 / 2), math.ceil(7 / 2))
