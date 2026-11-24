d = {"b": 2, "a": 1}
print(list(d.keys()), list(d.values()), list(d.items()), d.get("a"), d.get("q"), d.get("q", "none"))
print(d.pop("a"), d, d.pop("zz", "dflt"))
d.update({"c": 3}); d.update(b=20)
print(d, sorted(d), len(d), list(d))
try:
    d.pop("nope")
except KeyError as e:
    print("KeyError", e)
for k, v in sorted(d.items()):
    print(k, v)
