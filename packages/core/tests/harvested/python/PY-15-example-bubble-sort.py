# Bubble sort with a swap flag
numbers = [31, 7, 19, 2, 25, 11]
last = len(numbers) - 1
swapped = True

while swapped:
    swapped = False
    for i in range(last):
        if numbers[i] > numbers[i + 1]:
            numbers[i], numbers[i + 1] = numbers[i + 1], numbers[i]
            swapped = True
    last -= 1

print(numbers)
