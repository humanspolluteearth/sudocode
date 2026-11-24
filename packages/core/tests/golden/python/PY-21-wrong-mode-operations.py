f = open("a.txt", "w")
f.write("x")
f.close()
g = open("a.txt", "r")
try:
    g.write("y")
except Exception as e:
    print(type(e).__name__, e)
g.close()
h = open("a.txt", "w")
try:
    h.read()
except Exception as e:
    print(type(e).__name__, e)
h.close()
