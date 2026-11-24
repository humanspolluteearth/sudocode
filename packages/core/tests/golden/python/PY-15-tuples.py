t = (1, "two", 3.0)
print(t, t[1], t[-1], len(t), t + (4,), t[1:])
a, b = 1, 2
a, b = b, a
print(a, b)
x, (y, z) = 1, (2, 3)
print(x, y, z, (5,), ())
def divmod2(p, q):
    return p // q, p % q
q, r = divmod2(17, 5)
print(q, r, divmod2(9, 2))
print((1, 2) < (1, 3), (1, 2) == (1, 2), 2 in t)
