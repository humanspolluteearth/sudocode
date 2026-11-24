a = [3, 1, 2]
print(a[0], a[-1], a[1:], a[::-1], len(a), 2 in a)
b = [0] * 4
b[2] = 9
print(b)
grid = [[0] * 3 for _ in range(2)]
grid[1][2] = 5
print(grid)
m = [[1, 2], [3, 4]]
print(m[1][0], m[0] + m[1], [x * x for x in range(5)], [x for x in range(10) if x % 3 == 0])
for i, v in enumerate(a):
    print(i, v)
c = a
c.append(4)
d = a.copy()
d.append(5)
print(a, d, a is c, a == [3, 1, 2, 4])
a.sort(); print(a)
a.reverse(); print(a)
print(sorted([3, 1, 2], reverse=True), [1, 2] < [1, 3], [1, 2] + [3])
del a[0]
print(a)
