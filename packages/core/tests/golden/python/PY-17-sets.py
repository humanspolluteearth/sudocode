s = {3, 1, 2, 3}
s.add(4); s.add(1)
print(s, len(s), 2 in s, 9 in s)
s.remove(4)
print(s, {1, 2} | {2, 3}, {1, 2} & {2, 3}, {1, 2} - {2, 3}, {1, 2} ^ {2, 3})
print(set([1, 1, 2]), set("hello") == set("olleh"), sorted(set("banana")), set())
for x in sorted(s):
    print(x)
