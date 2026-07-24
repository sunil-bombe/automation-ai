Feature: OrangeHRM Demo

  Scenario: Successful login to OrangeHRM demo
    Given User opens "https://opensource-demo.orangehrmlive.com/web/index.php/auth/login"
    When User enters username "Admin"
    And User enters password "admin123"
    And User clicks "Login"
    Then "Dashboard" should be displayed

  Scenario: Failed login with invalid credentials
    Given User opens "https://opensource-demo.orangehrmlive.com/web/index.php/auth/login"
    When User enters username "Admin"
    And User enters password "wrongpassword"
    And User clicks "Login"
    Then "Invalid credentials" should be displayed

  Scenario: Add a new employee after login
    Given User opens "https://opensource-demo.orangehrmlive.com/web/index.php/auth/login"
    When User enters username "Admin"
    And User enters password "admin123"
    And User clicks "Login"
    And User clicks "PIM"
    And User clicks "Add Employee"
    And User enters first name "John"
    And User enters last name "Doe"
    And User clicks "Save"
    Then "Personal Details" should be displayed

  Scenario: Search for an existing employee by name
    Given User opens "https://opensource-demo.orangehrmlive.com/web/index.php/auth/login"
    When User enters username "Admin"
    And User enters password "admin123"
    And User clicks "Login"
    And User clicks "PIM"
    And User enters employee name "John Doe"
    And User clicks "Search"
    Then "John Doe" should be displayed in the results

  Scenario: Logout from OrangeHRM demo
    Given User opens "https://opensource-demo.orangehrmlive.com/web/index.php/auth/login"
    When User enters username "Admin"
    And User enters password "admin123"
    And User clicks "Login"
    And User clicks "Welcome Admin"
    And User clicks "Logout"
    Then "Login" should be displayed
