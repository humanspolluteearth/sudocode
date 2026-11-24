f = open("notes.txt", "w")
f.write("alpha\n")
f.write("beta\n")
print(f.write("gamma"))
f.close()
f = open("notes.txt", "r")
print(repr(f.read()))
f.close()
f = open("notes.txt")
print(repr(f.readline()), repr(f.readline()), repr(f.readline()), repr(f.readline()))
f.close()
f = open("notes.txt", "r")
print(f.readlines())
f.close()
with open("notes.txt", "a") as out:
    out.write("\ndelta\n")
with open("notes.txt") as f:
    for line in f:
        print(line.strip(), len(line))
with open("notes.txt") as f:
    first = f.readline()
    rest = f.read()
print(repr(first), repr(rest))
with open("nums.txt", "w") as f:
    f.writelines(["1\n", "2\n", "3\n"])
total = 0
with open("nums.txt") as f:
    for line in f:
        total += int(line)
print(total)
with open("nums.txt", "w") as f:
    f.write("overwritten\n")
print(open("nums.txt").read().strip())
