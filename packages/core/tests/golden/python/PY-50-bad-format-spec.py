print(format(5, ".2f"))
try:
    print(format("abc", "d"))
except ValueError as e:
    print("ValueError:", e)
try:
    print(f"{3.5:d}")
except ValueError as e:
    print("ValueError:", e)
try:
    print(format(1, "q"))
except ValueError as e:
    print("ValueError:", e)
print(f"{'x':>5s}")
