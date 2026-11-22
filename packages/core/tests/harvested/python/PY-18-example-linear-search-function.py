# Linear search in a function
def find(items, wanted):
    for i in range(len(items)):
        if items[i] == wanted:
            return i
    return -1

names = ["Ama", "Ben", "Chen", "Kofi", "Lina"]
target = input("Name to find: ")
position = find(names, target)

if position == -1:
    print(target, "not found")
else:
    print(target, "is at index", position)
