try:
    with open("log.txt", "w") as f:
        f.write("start\n")
        raise ValueError("boom")
except ValueError as e:
    print("caught", e)
with open("log.txt") as f:
    print(repr(f.read()))
try:
    f.read()
except ValueError as e:
    print(e)
