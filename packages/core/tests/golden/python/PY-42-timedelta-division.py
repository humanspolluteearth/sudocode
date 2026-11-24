from datetime import timedelta

d = timedelta(days=1, hours=12)
print(d / 2)
print(d // 2)
print(d / timedelta(hours=6))
print(d // timedelta(hours=5))
print(timedelta(seconds=7) // 2)
print(timedelta(days=-1) / 4)
try:
    d / 0
except ZeroDivisionError as e:
    print("ZeroDivisionError:", e)
try:
    d // timedelta(0)
except ZeroDivisionError as e:
    print("ZeroDivisionError:", e)
try:
    d / "x"
except TypeError as e:
    print("TypeError:", e)
