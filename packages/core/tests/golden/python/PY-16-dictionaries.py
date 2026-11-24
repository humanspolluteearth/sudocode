d = {"a": 1, "b": 2}
d["c"] = 3
d["a"] = 10
print(d, d["b"], len(d), "a" in d, "z" in d)
del d["b"]
print(d, d.get("z"), d.get("z", 0), list(d.keys()), list(d.values()), list(d.items()))
for k in d:
    print(k, d[k])
for k, v in d.items():
    print(k, "->", v)
print(d.pop("a"), d)
d.update({"x": 1, "y": 2})
print(d, {1: "one", 2.5: "x", (1, 2): "t", True: "b"}, {})
counts = {}
for w in "the cat the hat".split():
    counts[w] = counts.get(w, 0) + 1
print(counts, sorted(counts.items(), key=lambda p: p[1], reverse=True))
