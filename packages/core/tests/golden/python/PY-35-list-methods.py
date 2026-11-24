a = [5, 3]
a.append(8); a.insert(0, 1); a.insert(99, 7); a.extend([2, 2]); a.extend("ab")
print(a, a.pop(), a.pop(0), a, a.index(3), a.count(2))
a.remove(2)
print(a)
a.clear()
print(a, [3, 1, 2].copy())
b = [3, 1, 2]
b.sort(reverse=True); print(b)
b.sort(key=lambda v: v % 3); print(b)
try:
    [1].remove(9)
except ValueError as e:
    print(e)
try:
    [].pop()
except IndexError as e:
    print(e)
