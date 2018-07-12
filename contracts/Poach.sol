
import "./ERC721Base.sol";
import "./interfaces/Token.sol";
import "./rcn/utils/RpSafeMath.sol";

contract Poach is ERC721Base, RpSafeMath {
    struct Pair {
        Token token;
        uint256 amount;
        bool alive;
    }

    Pair[] public poaches;

    modifier alive(uint256 id) {
        require(poaches[id].alive);
        _;
    }

    function create(
        Token token,
        uint256 amount
    ) public returns (uint256 id) {
        require(token.transferFrom(msg.sender, this, amount));
        id = poaches.length;
        poaches.push(Pair(token, amount, true));
        _generate(id, msg.sender);
    }

    function deposit(
        uint256 id,
        uint256 amount
    ) public returns (bool) {
        Pair storage pair = poaches[id];
        require(pair.token.transferFrom(msg.sender, this, amount));
        pair.amount = safeAdd(pair.amount, amount);
        return true;
    }

    function destroy(uint256 id) public onlyAuthorized(id) alive(id) returns (bool) {
        Pair storage pair = poaches[id];
        require(pair.token.transfer(msg.sender, pair.amount));
        pair.alive = false;
        return true;
    }
}