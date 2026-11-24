try:
    open("nothere.txt")
except FileNotFoundError as e:
    print("caught", e)
print("before")
f = open("nothere.txt", "r")
print("never")
