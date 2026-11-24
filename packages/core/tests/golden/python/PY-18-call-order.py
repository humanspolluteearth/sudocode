def f(n):
    print("f", n)
    return n
print(f(1) + f(2) * f(3))
print([f(i) for i in range(2)], {f(9): f(8)})
