print(sorted([3, 1, 2]), sorted("bca"), sorted(["b", "A", "c"]), sorted([("b", 1), ("a", 2)]), sorted([3, 1, 2], reverse=True))
print(sorted(["bb", "a", "ccc"], key=len), list(reversed([1, 2, 3])), list(reversed("abc")))
print(list(enumerate("ab")), list(enumerate("ab", 1)), list(zip([1, 2, 3], "ab")), list(zip("ab", [1, 2], [True, False])))
print(any([0, 0, 1]), any([]), all([1, 1]), all([]), any(x > 2 for x in [1, 2, 3]))
for a, b in zip([1, 2], [3, 4]):
    print(a + b)
