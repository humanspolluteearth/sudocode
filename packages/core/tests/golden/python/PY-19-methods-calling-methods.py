class Stack:
    def __init__(self):
        self.items = []

    def push(self, item):
        self.items.append(item)

    def pop(self):
        if self.is_empty():
            raise IndexError("pop from empty stack")
        return self.items.pop()

    def is_empty(self):
        return len(self.items) == 0

    def size(self):
        return len(self.items)


class Node:
    def __init__(self, value, next=None):
        self.value = value
        self.next = next


s = Stack()
for n in range(3):
    s.push(n * n)
print(s.size(), s.pop(), s.pop(), s.pop(), s.is_empty())
try:
    s.pop()
except IndexError as e:
    print("caught:", e)
chain = Node(1, Node(2, Node(3)))
cur = chain
total = 0
while cur is not None:
    total += cur.value
    cur = cur.next
print(total)
first = Stack()
second = first
second.push("x")
print(first.size(), first is second)
