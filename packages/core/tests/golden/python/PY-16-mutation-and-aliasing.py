a = {"k": [1]}
b = a
b["k"].append(2)
c = dict(a)
c["z"] = 0
print(a, c, a is b, a is c)
def change(lst, d):
    lst.append(1)
    d["x"] = 1
    lst = [99]
l, dd = [], {}
change(l, dd)
print(l, dd)
x = [1, 2, 3]
y = x[:]
y[0] = 9
print(x, y)
