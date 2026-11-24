f = open("a.txt", "w")
try:
    f.write(5)
except TypeError as e:
    print(e)
f.close()
try:
    f.write("late")
except ValueError as e:
    print(e)
