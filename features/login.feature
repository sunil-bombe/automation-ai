Feature: Login

  Scenario: Successful Login
    Given User opens "https://practicetestautomation.com/practice-test-login/"
    When User enters username "student"
    And User enters password "Password123"
    And User clicks "Submit"
    Then "Logged In Successfully" should be displayed

  Scenario: Failed Login With Wrong Password
    Given User opens "https://practicetestautomation.com/practice-test-login/"
    When User enters username "student"
    And User enters password "wrongpassword"
    And User clicks "Submit"
    Then "Your password is invalid!" should be displayed
