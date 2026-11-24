def down(n):
    return down(n + 1)
try:
    down(0)
except RecursionError as e:
    print("caught", type(e).__name__)
def deep(n):
    return 0 if n == 0 else 1 + deep(n - 1)
print(deep(900))
down(0)
