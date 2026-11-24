def risky(x):
    return 10 / x
for v in [2, 0]:
    try:
        print(risky(v))
    except ZeroDivisionError as e:
        print("error:", e)
    else:
        print("fine")
    finally:
        print("done", v)
try:
    int("abc")
except ValueError as e:
    print(e)
try:
    [1, 2][5]
except IndexError as e:
    print(e)
try:
    {"a": 1}["b"]
except KeyError as e:
    print("KeyError", e)
try:
    "a" + 1
except TypeError as e:
    print(e)
try:
    print(undefined_name)
except NameError as e:
    print(e)
try:
    raise ValueError("custom")
except (TypeError, ValueError) as e:
    print(type(e).__name__, e)
try:
    raise KeyError("mine")
except Exception as e:
    print(type(e).__name__, e)
try:
    try:
        1 / 0
    except ZeroDivisionError:
        raise
except ZeroDivisionError as e:
    print("reraised", e)
print(int("12") + 1)
