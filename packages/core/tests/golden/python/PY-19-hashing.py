class Pt:
    def __init__(self, x):
        self.x = x

a = Pt(1)
b = Pt(1)
d = {a: "first"}
d[b] = "second"
print(len(d), d[a], d[b])
s = {a, b, a}
print(len(s), a in s, hash(a) == hash(a))

class Eq:
    def __init__(self, x):
        self.x = x
    def __eq__(self, other):
        return self.x == other.x

try:
    {Eq(1): 1}
except TypeError as e:
    print("TypeError:", e)

class Both:
    def __init__(self, x):
        self.x = x
    def __eq__(self, other):
        return self.x == other.x
    def __hash__(self):
        return hash(self.x)

print(len({Both(2), Both(2), Both(3)}))
print({Both(5): "five"}[Both(5)])
