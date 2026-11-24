try:
    open("a.txt", "z")
except ValueError as e:
    print(e)
try:
    open("a.txt", "rw")
except ValueError as e:
    print(e)
