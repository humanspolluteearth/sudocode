class Account:
    def __init__(self, owner, balance):
        self.owner = owner
        self.__balance = balance

    def deposit(self, amount):
        if amount > 0:
            self.__balance += amount

    def get_balance(self):
        return self.__balance

    def __check(self):
        return self.__balance >= 0

    def ok(self):
        return self.__check()


acc = Account("Ann", 100)
acc.deposit(50)
print(acc.get_balance(), acc.ok())
print(acc._Account__balance)
try:
    print(acc.__balance)
except AttributeError as e:
    print("AttributeError:", e)
try:
    acc.__check()
except AttributeError as e:
    print("AttributeError:", e)
acc.__balance = 5
print(acc.get_balance(), acc.__balance)
